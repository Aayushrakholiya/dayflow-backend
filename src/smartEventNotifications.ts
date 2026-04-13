/*  
*  FILE          : smartEventNotifications.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Background job that sends push notifications 5 minutes before event start time.
*/ 

import prisma from "./db";
import { sendFCMToMultipleDevices } from "./services/fcmService";
import { logger } from "./lib/logging";

/**
 * Smart Event Notification Job
 * Runs every minute to check for events starting soon
 * Sends push notification 5 minutes before event start
 */

const NOTIFY_BEFORE_MINUTES = 5; // Send notification 5 mins before event
const NOTIFICATION_WINDOW_MINUTES = 2; // Look in a 2-minute window around the 5-minute mark
const sentNotifications = new Set<string>(); // Track sent notifications to prevent duplicates

export async function processEventNotifications() {
  try {
    // Calculate time window: events starting ~5 minutes from now (with buffer)
    const now = new Date();
    const notifyStartTime = new Date(now.getTime() + (NOTIFY_BEFORE_MINUTES - NOTIFICATION_WINDOW_MINUTES) * 60 * 1000);
    const notifyEndTime = new Date(now.getTime() + (NOTIFY_BEFORE_MINUTES + NOTIFICATION_WINDOW_MINUTES) * 60 * 1000);

    // logger.info("🔍 NOTIFICATION JOB RUN", {
    //   currentServerTime: now.toISOString(),
    //   currentServerTimeLocal: now.toString(),
    //   notifyWindow: `${notifyStartTime.toISOString()} - ${notifyEndTime.toISOString()}`,
    // });

    // Find ALL events for today first (we'll filter by time manually)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // logger.info("📋 Fetching today's events", { todayStart: todayStart.toISOString(), todayEnd: todayEnd.toISOString() });

    const allTodayEvents = await prisma.event.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        completed: false,
      },
      include: {
        user: {
          select: { id: true, fullName: true, deviceTokens: true },
        },
      },
    });

    // Also get imported events for today
    const allTodayImportedEvents = await prisma.importedEvent.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        user: {
          select: { id: true, fullName: true, deviceTokens: true },
        },
      },
    });

    // logger.info("📌 Found events for today", { count: allTodayEvents.length });

    // Combine regular and imported events
    const allEvents = [
      ...allTodayEvents.map(e => ({ ...e, isImported: false })),
      ...allTodayImportedEvents.map(e => ({ ...e, isImported: true }))
    ];

    // Filter events by START HOUR (not just by date)
    // Calculate actual event start time = date + startHour
    const upcomingEvents = allEvents.filter(event => {
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
      const eventStartTime = new Date(eventDate);
      
      // Add startHour to the date to get actual start time (use LOCAL timezone, not UTC)
      if (event.startHour) {
        const hours = Math.floor(event.startHour);
        const minutes = (event.startHour - hours) * 60;
        eventStartTime.setHours(hours, minutes, 0, 0);
      }

      const inWindow = eventStartTime >= notifyStartTime && eventStartTime < notifyEndTime;

      return inWindow;
    });

    // Deduplicate events by title, date, startHour, and userId to prevent duplicate notifications
    const seenEventSignatures = new Set<string>();
    const deduplicatedEvents = upcomingEvents.filter(event => {
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
      const signature = `${event.userId}-${event.title}-${eventDate.toISOString()}-${event.startHour}`;
      
      if (seenEventSignatures.has(signature)) {
        return false; // Skip duplicate
      }
      
      seenEventSignatures.add(signature);
      return true;
    });

    // logger.info("✅ Filtered upcoming events", { count: deduplicatedEvents.length });

    if (deduplicatedEvents.length === 0) {
      // logger.info("ℹ️ No upcoming events to notify in this window");
      return;
    }

    // logger.info("Found upcoming events to notify", {
    //   count: deduplicatedEvents.length,
    //   events: deduplicatedEvents.map(e => ({
    //     id: e.id,
    //     title: e.title,
    //     scheduledDate: e.date.toISOString(),
    //     startHour: e.startHour,
    //     endHour: e.endHour,
    //   }))
    // });

    // Send notifications
    let totalNotifications = 0;
    for (const event of deduplicatedEvents) {
      // Skip if we already sent notification for this event
      const eventType = event.isImported ? 'imported' : 'regular';
      const notificationKey = `event-${eventType}-${event.id}`;
      if (sentNotifications.has(notificationKey)) {
        // logger.debug("Notification already sent for event", { eventId: event.id });
        continue;
      }
      if (!event.user.deviceTokens || event.user.deviceTokens.length === 0) {
        // logger.debug("No device tokens for user", { userId: event.user.id });
        continue;
      }

      // Combine date + startHour for actual event start time
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
      const eventStartTime = new Date(eventDate);
      if (event.startHour) {
        const hours = Math.floor(event.startHour);
        const minutes = (event.startHour - hours) * 60;
        eventStartTime.setHours(hours, minutes, 0, 0);
      }

      const timeStr = eventStartTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Double-check this event is actually within notification window
      const minutesUntilEvent = (eventStartTime.getTime() - now.getTime()) / (60 * 1000);
      // logger.info("📌 Event timing check", {
      //   eventId: event.id,
      //   eventTitle: event.title,
      //   eventStartTime: eventStartTime.toISOString(),
      //   minutesUntilStart: minutesUntilEvent.toFixed(1),
      //   expectedMinutes: NOTIFY_BEFORE_MINUTES,
      // });

      const message = {
        title: "Upcoming Event",
        body: `${event.title} is starting at ${timeStr}`,
        data: {
          eventId: String(event.id),
          userId: String(event.userId),
          actionUrl: "/main",
        },
        icon: "/favicon.ico",
      };

      const sentCount = await sendFCMToMultipleDevices(event.user.deviceTokens, message);
      totalNotifications += sentCount;

      // Mark as sent to prevent duplicate notifications
      sentNotifications.add(notificationKey);

      logger.info("Event notification sent", {
        eventId: event.id,
        eventTitle: event.title,
        userId: event.user.id,
        deviceCount: event.user.deviceTokens.length,
        sentCount,
        imported: event.isImported ? "yes" : "no",
      });
    }

    // logger.info("Event notification job completed", { totalNotifications });
  } catch (error) {
    logger.error("Error processing event notifications", { error });
  }
}

/**
 * Same for tasks
 */
export async function processTaskNotifications() {
  try {
    const now = new Date();
    const notifyStartTime = new Date(now.getTime() + (NOTIFY_BEFORE_MINUTES - NOTIFICATION_WINDOW_MINUTES) * 60 * 1000);
    const notifyEndTime = new Date(now.getTime() + (NOTIFY_BEFORE_MINUTES + NOTIFICATION_WINDOW_MINUTES) * 60 * 1000);

    // logger.debug("Checking for tasks to notify", {
    //   now: now.toISOString(),
    //   notifyWindow: `${notifyStartTime.toISOString()} - ${notifyEndTime.toISOString()}`,
    // });

    // Find ALL tasks for today first (we'll filter by time manually)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const allTodayTasks = await prisma.task.findMany({
      where: {
        dueDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        user: {
          select: { id: true, fullName: true, deviceTokens: true },
        },
      },
    });

    // Filter tasks by START HOUR (not just by date)
    // Calculate actual due time = dueDate + startHour
    const upcomingTasks = allTodayTasks.filter(task => {
      const taskDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      const taskDueTime = new Date(taskDate);
      
      // Add startHour to the date to get actual due time (use LOCAL timezone, not UTC)
      if (task.startHour) {
        const hours = Math.floor(task.startHour);
        const minutes = (task.startHour - hours) * 60;
        taskDueTime.setHours(hours, minutes, 0, 0);
      }

      // Check if this task falls in the notification window
      return taskDueTime >= notifyStartTime && taskDueTime < notifyEndTime;
    });

    if (upcomingTasks.length === 0) {
      // logger.info("ℹ️ No upcoming tasks to notify in this window");
      return;
    }

    // logger.info("Found upcoming tasks to notify", {
    //   count: upcomingTasks.length,
    //   tasks: upcomingTasks.map(t => ({
    //     id: t.id,
    //     title: t.title,
    //     dueDate: t.dueDate.toISOString(),
    //   }))
    // });

    let totalNotifications = 0;
    for (const task of upcomingTasks) {
      // Skip if we already sent notification for this task
      const notificationKey = `task-${task.id}`;
      if (sentNotifications.has(notificationKey)) {
        // logger.debug("Notification already sent for task", { taskId: task.id });
        continue;
      }

      if (!task.user.deviceTokens || task.user.deviceTokens.length === 0) {
        // logger.debug("No device tokens for user", { userId: task.user.id });
        continue;
      }

      // Combine date + startHour for actual task due time
      const taskDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      const taskDueTime = new Date(taskDate);
      if (task.startHour) {
        const hours = Math.floor(task.startHour);
        const minutes = (task.startHour - hours) * 60;
        taskDueTime.setHours(hours, minutes, 0, 0);
      }
      
      // Double-check this task is actually within notification window
      const minutesUntilDue = (taskDueTime.getTime() - now.getTime()) / (60 * 1000);
      // logger.info("📌 Task timing check", {
      //   taskId: task.id,
      //   taskTitle: task.title,
      //   dueTime: taskDueTime.toISOString(),
      //   minutesUntilDue: minutesUntilDue.toFixed(1),
      //   expectedMinutes: NOTIFY_BEFORE_MINUTES,
      // });

      const timeStr = taskDueTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const message = {
        title: "Task Due Soon",
        body: `Task "${task.title}" is due at ${timeStr}`,
        data: {
          taskId: String(task.id),
          userId: String(task.userId),
          actionUrl: "/main",
        },
        icon: "/favicon.ico",
      };

      const sentCount = await sendFCMToMultipleDevices(task.user.deviceTokens, message);
      totalNotifications += sentCount;

      // Mark as sent to prevent duplicate notifications
      sentNotifications.add(notificationKey);

      logger.info("Task notification sent", {
        taskId: task.id,
        taskTitle: task.title,
        userId: task.user.id,
        deviceCount: task.user.deviceTokens.length,
        sentCount,
      });
    }

    // logger.info("Task notification job completed", { totalNotifications });
  } catch (error) {
    logger.error("Error processing task notifications", { error });
  }
}

/**
 * Run all notification jobs
 */
export async function runAllNotificationJobs() {
  await Promise.all([processEventNotifications(), processTaskNotifications()]);
}
