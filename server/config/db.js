const mongoose = require('mongoose');

let memoryServer;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/artgallary';

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    if (process.env.USE_MEMORY_DB !== 'false') {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create({
          binary: { version: '7.0.14' },
          instance: { dbName: 'artgallary' }
        });
        await mongoose.connect(memoryServer.getUri('artgallary'));
        console.log('MongoDB connected to in-memory fallback');
        return true;
      } catch (memoryError) {
        console.error('MongoDB connection error:', error);
        console.error('In-memory fallback failed:', memoryError);
        process.exit(1);
      }
    }

    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }

  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;
