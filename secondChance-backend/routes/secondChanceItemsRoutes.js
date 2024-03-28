const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const connectToDatabase = require('../models/db')
const logger = require('../logger')

// Define the upload directory path
const directoryPath = 'public/images'

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, directoryPath) // Specify the upload directory
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname) // Use the original file name
  },
})

const upload = multer({ storage: storage })

async function extractdb() {
  const db = await connectToDatabase()
  const collection = db.collection('secondChanceItems')
  return { db, collection }
}

// Get all secondChanceItems
router.get('/', async (req, res, next) => {
  logger.info('/ called')
  try {
    const { collection } = await extractdb()
    const secondChanceItems = await collection.find({}).toArray()
    res.json(secondChanceItems)
  } catch (e) {
    logger.console.error('oops something went wrong', e)
    next(e)
  }
})

// Add a new item
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { collection } = await extractdb()
    const secondChanceItem = req.body
    if (
      !secondChanceItem.category ||
      !secondChanceItem.condition ||
      !secondChanceItem.age_days ||
      !secondChanceItem.description
    ) {
      logger.error('missing required fields')
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const lastItemQuery = await collection.find().sort({ id: -1 }).limit(1) // Get the last item in the collection
    await lastItemQuery.forEach((item) => {
      secondChanceItem.id = (parseInt(item.id) + 1).toString()
    })
    const date_added = Math.floor(new Date().getTime() / 1000)
    secondChanceItem.date_added = date_added
    secondChanceItem = await collection.insertOne(secondChanceItem)
    res.status(201).json(secondChanceItem.ops[0])
  } catch (e) {
    next(e)
  }
})

// Get a single secondChanceItem by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { collection } = await extractdb()
    const secondChanceItem = await collection.findOne({ id: req.params.id })
    if (!secondChanceItem) {
      logger.error('item not found')
      return res.status(404).json({ error: 'Item not found' })
    }
    res.json(secondChanceItem)
  } catch (e) {
    next(e)
  }
})

// Update and existing item
router.put('/:id', async (req, res, next) => {
  try {
    const { collection } = await extractdb()
    const secondChanceItem = await collection.findOne({ id: req.params.id })
    if (!secondChanceItem) {
      logger.error('secondChanceItem not found')
      return res.status(404).json({ error: 'Item not found' })
    }
    secondChanceItem.category = req.body.category
    secondChanceItem.condition = req.body.condition
    secondChanceItem.age_days = req.body.age_days
    secondChanceItem.description = req.body.description
    secondChanceItem.age_years = Number(
      (secondChanceItem.age_days / 365).toFixed(1),
    )
    secondChanceItem.updatedAt = new Date()
    const updateItem = await collection.findOneAndUpdate(
      { id },
      { $set: secondChanceItem },
      { returnDocument: 'after' },
    )
    if (!updateItem) {
      logger.error('secondChanceItem not found')
      return res.status(404).json({ upload: 'failed upload' })
    }
    res.json({ upload: 'success' })
  } catch (e) {
    next(e)
  }
})

// Delete an existing item
router.delete('/:id', async (req, res, next) => {
  try {
    const { collection } = await extractdb()
    const secondChanceItem = await collection.findOne({ id: req.params.id })
    if (!secondChanceItem) {
      logger.error('secondChanceItem not found')
      return res.status(404).json({ error: 'Item not found' })
    }
    await collection.deleteOne({ id: req.params.id })
    res.json({ deleted: 'deleted item successfully' })
  } catch (e) {
    next(e)
  }
})

module.exports = router
