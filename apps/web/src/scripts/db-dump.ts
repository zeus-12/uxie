import { env } from "@/env.mjs";
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import fs from "fs";
import util from "util";

const execPromise = util.promisify(exec);

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;

  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const url = new URL(dbUrl);

  const PGPASSWORD = url.password;
  const PGHOST = url.hostname;
  const PGUSER = url.username;
  const PGDATABASE = url.pathname.split("/").pop();
  const PGPORT = url.port;

  try {
    await execPromise(
      `PGPASSWORD=${PGPASSWORD} pg_dump -h ${PGHOST} -U ${PGUSER} -d ${PGDATABASE} -p ${PGPORT} -f ${filename}`,
    );

    const fileBuffer = fs.readFileSync(filename);

    const supabase = createClient(
      env.PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
    );

    const { data, error } = await supabase.storage
      .from("database-backups")
      .upload(filename, fileBuffer, {
        contentType: "application/sql",
      });

    if (error) {
      throw new Error(`Error uploading to Supabase Storage: ${error.message}`);
    }

    console.log("Backup uploaded to Supabase Storage:", data?.path);

    fs.unlinkSync(filename);
    console.log("Local backup file deleted");
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

backupDatabase();
