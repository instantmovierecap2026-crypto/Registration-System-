import serverless from 'serverless-http';
import app from '../../server';

// Export the serverless handler
export const handler = serverless(app);
