import { ilike, eq } from 'drizzle-orm';
import {db} from './db';
import { todosTable } from './db/schema';
import OpenAI from "openai";


const openai = new OpenAI();


async function getAllTodos() {
    const todo = await db.select(todosTable).from(todosTable);
    return todo;
}

async function createTodo(todo) {
    await db.insert(todosTable).values({
        todo,
});
}


async function searchTodo(search) {
    const todo = await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, search));
    return todo;
}


async function deleteTodoById(id) {
    await db.delete(todosTable).where(eq(todosTable.id, id));
}


const SYTSTEM_PROMPT = `
You are an AI To-Do List Assistant with START, PLAN, ACTION, Obeservation and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, Take the action with appropriate tools and wait for Observation based on Action.
Once you get the observations, Return the AI response based on START propmt and observations

You can manage tasks by adding, viewing, updating, and deleting them.
You must strictly follow the JSON output format.


Todo DB Schema:
id: Int and Primary Key
todo: String
created_at: Date Time
updated_at: Date Time

Available Tools:
- getAllTodos(): Returns all the Todos from Database
- createTodo (todo: string): Creates a new Todo in the DB and takes todo as a string
- deleteTodoById(id: string): Deleted the todo by ID given in the DB
- search Todo (query: string): Searches for all todos matching teh query string using iLike in DB
`;