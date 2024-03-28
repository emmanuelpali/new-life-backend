const express = require('express')
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
const connectToDatabase = require('../models/db')
const router = express.Router()
const dotenv = require('dotenv')
const pino = require('pino') // Import Pino logger
dotenv.config()
const logger = pino() // Create a Pino logger instance

const { body, validationResult } = require('express-validator')
const JWT_SECRET = process.env.JWT_SECRET

router.post('/register', async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('users')

    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Invalid request' })
    }

    const emailExists = await collection.findOne({ email })
    if (emailExists) {
      logger.error('Email already exists')
      return res.status(400).json({ error: 'Email already exists' })
    }

    const salt = await bcryptjs.genSalt(10)
    const hashedPassword = await bcryptjs.hash(password, salt)
    const newUser = await collection.insertOne({
      email,
      password: hashedPassword,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      createdAt: new Date(),
    })

    const payload = {
      user: {
        id: newUser.insertedId,
      },
    }

    const authtoken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
    logger.info('User registered successfully')
    res.json({ authtoken, email })
  } catch (e) {
    logger.error(`Error registering user: ${e}`)
    return res.status(500).json({ error: 'Server error' })
  }
})

//login endpoint
router.post('/login', async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('users')
    const user = await collection.findOne({ email: req.body.email })
    if (user) {
      let passwordMatch = await bcryptjs.compare(
        req.body.password,
        user.password,
      )
      if (!passwordMatch) {
        logger.error('Invalid credentials')
        return res.status(400).json({ error: 'Invalid credentials' })
      }
      //fetch the user details
      let payload = {
        user: {
          id: user._id.toString(),
        },
      }

      const userName = user.firstName
      const userEmail = user.email
      //create jwt token
      const authtoken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
      logger.info('User logged in successfully')
      return res.status(200).json({ authtoken, userName, userEmail })
    } else {
      logger.error('Invalid credentials')
      return res.status(400).json({ error: 'Invalid credentials' })
    }
  } catch (e) {
    logger.error(`Error logging in user: ${e}`)
    return res.status(500).json({ error: 'Server error', message: e.message })
  }
})

// update user details
router.put('/update', async (req, res, next) => {
  //  Validate the request body
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    logger.error('Validation erros in updating user details', errors.array())
    return res.status(400).json({ errors: errors.array() })
  }
  // check if email is in the request body
  try {
    const email = req.headers.email
    if (!email) {
      logger.error('Email not provided')
      return res.status(400).json({ error: 'Email not provided' })
    }

    //connect to the database
    const db = await connectToDatabase()
    const collection = db.collection('users')

    //find user credentials
    const existingUser = await collection.findOne({ email })

    if (!existingUser) {
      logger.error('User not found')
      return res.status(404).json({ error: 'User not found' })
    }

    existingUser.firstName = req.body.firstname
    existingUser.lastName = req.body.lastname
    existingUser.updatedAt = new Date()

    //update user details in database
    const updatedUser = await collection.findOneAndUpdate(
      { email },
      { $set: existingUser },
      { returnDocument: 'after' },
    )

    // create jwt token with user._id as payload using secret key from .env file
    const payload = {
      user: {
        id: updatedUser._id.toString(),
      },
    }

    const authtoken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
    logger.info('User details updated successfully')
    return res.status(200).json({ authtoken })
  } catch (error) {
    logger.error(error)
    return res.status(500).send('Internal Server Error')
  }
})

module.exports = router
