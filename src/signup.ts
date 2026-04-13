/*  
*  FILE          : signup.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Validates user input, hashes password, creates user account, and returns JWT token.
*/ 

import express from "express";
import prisma from "./db";
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';


export default function createSignupRouter() {
  const router = express.Router();

// this will validate that if the user has entered full name or not 
const isValidFullName = (name: string) => {
  const trimmed = name.trim();
  return /^[A-Za-z]+(\s+[A-Za-z]+)+$/.test(trimmed);
}

// this will validate that if the user has entered proper email or not like the format of it
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// this will validate if the user has entered password is with the proper requirements or not
const isValidPassword = (password: string) => {

  // this will check if password length is between 6 to 12 characters
 if (password.length < 6 || password.length > 12) {
  return false;
 }

 // this will check if password contains any spaces
 if (/\s/.test(password)) {
  return false;
 }

 // this will check if password contains at least one capital letter
 if (!/[A-Z]/.test(password)) {
  return false;
 }

 // this will check if password contains at least one number
 if (!/[0-9]/.test(password)) {
  return false;
 }

 // this will check if password contains at least one special character
 if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  return false;
 }

 return true;

}

// this will handle the new user 
router.post("/signup", async (req, res) => {

  try {

    // this will extract the input  
    const { fullName, email, password } = req.body;
    
    // this will check if all the requried fields are entered or not 
    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }
    
    // this will validate if the user has entered full name or not 
    if (!isValidFullName(fullName)) {
      return res.status(400).json({
        message: "Please enter your full name (first and last name)",
      });
    }
    
    // this will validate the email that has been entered by the user 
    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }
    
    // this will validate the password entered by the user 
    if (!isValidPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 6-12 characters long and should include atleast one captial letter, one special character and one number",
      });
    }
    
    // this will check if the entered email is previously used or not 
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }
    
    // this will hash the password before storing it in the database
    const hashPass = await argon2.hash(password);

    // this will create the user in the database
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashPass,
      }
    });
    
    // Sign a JWT so the frontend can log the user in immediately after signup
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Server misconfiguration." });
    }

    const token = jwt.sign(
      { userId: newUser.id, fullName: newUser.fullName, email: newUser.email },
      secret,
      { expiresIn: "7d", algorithm: "HS256" }
    );

    // this will send the success message 
    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
      },
    });
    } 
    catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({
        message: "Internal server error",
      });
    }
});

  return router;
}