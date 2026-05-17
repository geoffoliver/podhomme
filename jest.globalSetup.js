const { execSync } = require('child_process');

module.exports = async function () {
  execSync('yarn prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' },
    stdio: 'inherit',
  });
};
