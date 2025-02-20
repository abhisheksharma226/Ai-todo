import 'dotenv/config';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL); // Ensure DATABASE_URL is correct
export const db = drizzle(sql);

