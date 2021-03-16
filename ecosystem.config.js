module.exports = {
  apps : [{
    name: 'raidCost',
    script: 'app.js',
    watch: '.',
    instances: 1,
    autorestart: true,
    ignore_watch : ['scripts', 'node_modules', 'views', 'css',  'js', '.git', 'img', 'icons', 'jupyter', 'script', '.ipynb_checkpoints', 'test', 'logs', 'public'],
  }]
};
