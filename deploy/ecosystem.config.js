module.exports = {
  apps: [
    {
      name: 'auction-server',
      cwd: './server',
      script: 'dist/index.js',
      env_production: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
    {
      name: 'auction-client',
      cwd: './client',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env_production: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
  ],
};
