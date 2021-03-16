const express = require('express')
const router = express.Router()
const wcl = require('../models/wcl')
const parser = require('accept-language-parser');

const parseLanguage = (req, res) => {
  const languages = parser.parse(req.headers['accept-language'])  
  for ( var i = 0; i < languages.length; i++ ) {
    if (supportedLanguages.includes(languages[i].code)) {
      res.redirect(`/${languages[i].code}${req.path}`)
      return
    } else if (languages[i].code == 'zh' && chineseLocales.includes(languages[i].region.toLowerCase())) {
      res.redirect(`/${languages[i].region.toLowerCase()}${req.path}`)
      return
    }
  }
  res.redirect(`/en${req.path}`)
}

router.get('/.heartbeat', (req, res) => {
  res.json({'status': 'success'})
})

router.get('/', parseLanguage)
router.get('/:locale', (req, res) => {
  // TODO: Make localized landing
  // res.render(`${req.params.locale}-index.ejs`, {})
  res.render('index.ejs', {})
})

const supportedLanguages = ['en', 'es', 'pt', 'de', 'fr', 'ru', 'ko']
const chineseLocales = ['tw', 'cn']
router.get('/reports/:raidLogId', parseLanguage)

router.get('/:locale/reports/:raidLogId', async (req, res) => {
  let data = await wcl.getData(req.params.raidLogId, req.params.locale)
  if (!data) {
    res.render('notFound.ejs')
    return
  }
  data.locale = req.params.locale != 'en' && req.params.locale != 'tw' ? req.params.locale + '.' : ''
  res.render('report.ejs', data)  
})


module.exports = router