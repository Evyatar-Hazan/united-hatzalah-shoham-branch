import app from './app';
import prisma from './db/prisma';
import type { Server } from 'node:http';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

let server: Server;

const startServer = async () => {
  try {
    // Initialize Prisma connection (SQLite/PostgreSQL)
    await prisma.$connect();

    server = app.listen(PORT, () => {
      console.log(`✅ Server is running on http://${HOST}:${PORT}`);
      console.log(`📝 API documentation available at http://${HOST}:${PORT}/api`);
      console.log(`🏥 Health check at http://${HOST}:${PORT}/api/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
