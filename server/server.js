import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";
import cors from "cors";

import User from "./Schema/User.js";

dotenv.config();

const server = express();
let PORT = 3000;
let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; 

server.use(express.json());
server.use(cors());

mongoose
  .connect(process.env.MONGO_URI, {

  })
  .then(() => {
    console.log("Connected to MongoDB!");
  })
  .catch((error) => {
    console.log("Failed to connect to MongoDB!", error);
  });

  const formDatatoSend = (user) => {
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

    return {
      accessToken,
      profile_img: user.personal_info.profile_img,
      username: user.personal_info.username,
      fullname: user.personal_info.fullname
    }
  };

const generateUsername = async (email) => {
  let username = email.split("@")[0];

  let isUsernameExist = await User.exists({
    "personal_info.username": username,
  }).then((result) => result);

  isUsernameExist ? username += nanoid().substring(0, 5) : "";

  return username;
};

server.post("/signup", (req, res) => {
  let { fullname, email, password } = req.body;

  // Validate data from frontend
  if (fullname.length < 3) {
    return res
      .status(403)
      .json({ error: "Full name must be at least 3 characters long" });
  }

  if (!email.length) {
    return res.status(403).json({ error: "Email is required" });
  }

  if (!emailRegex.test(email)) {
    return res.status(403).json({ error: "Invalid email" });
  }

  if (!passwordRegex.test(password)) {
    return res.status(403).json({
      error:
        "Password should be 6 - 20 characters must contain at least 1 uppercase letter, 1 lowercase letter, 1 numeric 1 number",
    });
  }

  // Hash password
  bcrypt.hash(password, 10, async (err, hashedPassword) => {
    let username = await generateUsername(email);

    let newUser = new User({
      personal_info: {
        fullname,
        email,
        password: hashedPassword,
        username,
      },
    });

    newUser
      .save()
      .then((u) => {
        return res.status(200).json(formDatatoSend(u));
      })
      .catch((error) => {
        if (error.code === 11000) {
          return res.status(500).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: error.message });
      });
  });
});

server.post("/signin", (req, res) => {
  let { email, password } = req.body;

  User.findOne({ "personal_info.email": email })
  .then((user) => {
    if (!user) {
      return res.status(403).json({ "error": "User not found" })
    }
    
    bcrypt.compare(password, user.personal_info.password, (err, result) => {

      if (err) {
        return res.status(500).json({ "error": err.message });
      }

      if (result) {
        return res.json(formDatatoSend(user));
      } else {
        return res.status(403).json({ "error": "Invalid password" });
      }
    });
  })
  .catch((err) => {
    console.log(err)
    return res.status(500).json({ "error": err.message });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
