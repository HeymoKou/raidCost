const express = require('express')
const router = express.Router()
const wcl = require('../models/wcl')

router.get('/.heartbeat', (req, res) => {
  res.json({'status': 'success'})
})

router.get('/', async (req, res) => {
  res.render('index.ejs', {})
})

router.get('/reports/:raidLogId', async (req, res) => {
  const data = await wcl.getData(req.params.raidLogId)
  if (!data) {
    res.render('notFound.ejs')
  }
  else {
    res.render('report.ejs', data)
  }  
})


module.exports = router