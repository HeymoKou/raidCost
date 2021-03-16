const express = require('express')
const helmet = require('helmet')
const app = express()
const http = require('http').Server(app)

app.use(helmet({ contentSecurityPolicy: false }))

app.set('view engine', 'ejs')
app.use('/img', express.static('img'));
app.use('/', require('./routes/app'))

app.use(function(req,res){
  res.status(404).render('404.ejs')
});

const port = 3000
http.listen(port, () => {
  console.log('listening at port ', port)
})