const express = require('express')
const app = express()
const http = require('http').Server(app)

app.set('view engine', 'ejs')
app.use('/', require('./routes/app'))

app.use(function(req,res){
  res.status(404).render('404.ejs')
});

const port = 3000
// const port = 80
http.listen(port, () => {
  console.log('listening at port ', port)
})