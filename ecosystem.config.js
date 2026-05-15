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
    {
      name: 'podhomme-worker',
      script: 'node_modules/.bin/tsx',
      args: 'worker/index.ts',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
