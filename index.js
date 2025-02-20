import dotenv from "dotenv";
import { ilike, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";
import readlineSync from "readline-sync";
import fetch from "node-fetch";

dotenv.config();

const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;
const HF_MODEL = "tiiuae/falcon-7b-instruct";

if (!HUGGING_FACE_API_KEY) {
  console.error("❌ Missing Hugging Face API Key. Please set it in the .env file.");
  process.exit(1);
}

// Database functions
async function getAllTodos() {
  return await db.select().from(todosTable);
}

async function createTodo(todo) {
  try {
    if (!todo || typeof todo !== "string") {
      throw new Error("Invalid todo input");
    }

    const [result] = await db
      .insert(todosTable)
      .values({ todo })
      .returning(["id"]); // Fix returning

    console.log("Inserted Todo:", result);
    return result?.id;
  } catch (error) {
    console.error("Error inserting todo:", error);
    throw new Error("Failed to create todo");
  }
}


async function searchTodo(search) {
  return await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, `%${search}%`));
}

async function deleteTodoById(id) {
  await db.delete(todosTable).where(eq(todosTable.id, id));
}

const tools = {
  getAllTodos,
  createTodo,
  searchTodo,
  deleteTodoById,
};

const SYSTEM_PROMPT = `
You are an AI To-Do List Assistant.
You can manage tasks by adding, viewing, updating, and deleting them.
You must follow the JSON output format.
Always return a valid JSON object without any additional text. 
Format: {"status": "success", "message": "Task added successfully"}.
You are a To-Do List Assistant. Always return a valid JSON object without any additional text.
You are an AI To-Do List Assistant. Always return a valid JSON object in the format: {\"status\": \"success\", \"message\": \"Task added successfully\"}. No extra text or explanations.

Todo DB Schema:
- id: Int (Primary Key)
- todo: String
- created_at: Date Time
- updated_at: Date Time

Available Tools:
- getAllTodos(): Returns all Todos from Database
- createTodo(todo: string): Creates a new Todo in the DB
- deleteTodoById(id: string): Deletes a Todo by ID
- searchTodo(query: string): Searches for todos using iLike in DB
`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];

async function sendToHuggingFace(prompt) {
  try {
    console.log("🔄 Sending request to Hugging Face...");

    const response = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      console.error(`❌ Hugging Face API error: ${response.status} - ${response.statusText}`);
      return JSON.stringify({ type: "output", output: "Hugging Face API error. Try again later." });
    }

    const data = await response.json();
    console.log("✅ Hugging Face Raw Response:", JSON.stringify(data, null, 2));

    if (!Array.isArray(data) || data.length === 0 || !data[0]?.generated_text) {
      console.error("❌ Invalid Hugging Face response format.");
      return JSON.stringify({ type: "output", output: "AI response error. Try again." });
    }

    return data[0].generated_text;
  } catch (error) {
    console.error("❌ Error sending request to Hugging Face:", error.message);
    return JSON.stringify({ type: "output", output: "AI request failed. Try again later." });
  }
}

async function main() {
  console.log("🤖 AI To-Do List Assistant Started!");

  while (true) {
    const query = readlineSync.question(">> ");
    messages.push({ role: "user", content: query });

    while (true) {
      const rawResult = await sendToHuggingFace(JSON.stringify(messages));
      console.log("📥 AI Raw Response:", rawResult);

      let result;
      try {
        result = JSON.parse(rawResult);
      } catch (error) {
        console.error("❌ Failed to parse AI response:", error.message);
        console.log(`📝 AI: ${rawResult}`);
        break;
      }

      messages.push({ role: "assistant", content: JSON.stringify(result) });

      if (result.type === "output") {
        console.log(`✅ AI: ${result.output}`);
        break;
      } else if (result.type === "action") {
        const fn = tools[result.function];

        if (!fn) {
          console.error(`❌ Invalid function call: ${result.function}`);
          break;
        }

        try {
          const observation = await fn(result.input);
          console.log(`🔹 Function executed: ${result.function}`);
          const observationMessage = { type: "observation", observation };
          messages.push({ role: "developer", content: JSON.stringify(observationMessage) });
        } catch (err) {
          console.error(`❌ Error executing function ${result.function}: ${err.message}`);
          break;
        }
      }
    }
  }
} // ✅ Ensure this closing bracket is present!

main(); // ✅ Ensure this line is present!
