module.exports = {
  apps: [
    {
      name: 'podhomme-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3030,
      },
    },
  ],
};
