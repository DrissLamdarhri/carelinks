import { createClient } from "@supabase/supabase-js";

const projectId = "wjhzrovmktekfcjohhrw";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHpyb3Zta3Rla2ZjamhoaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcwNDUyNDgsImV4cCI6MjAzMjYyMTI0OH0.VpCyQJN3oZF30j1P0vhx9QkJKKJPrPEqM9dF4qNmIZw";

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  anonKey
);

async function debug() {
  console.log("=== Checking Storage Paths ===\n");

  // Get sample documents from pro_documents table
  const { data: docs, error: docError } = await supabase
    .from("pro_documents")
    .select("id, professional_id, doc_type, storage_path, uploaded_at")
    .limit(10);

  if (docError) {
    console.error("Error fetching pro_documents:", docError);
    return;
  }

  console.log("Sample documents in table:");
  docs.forEach((doc) => {
    console.log(`  ${doc.doc_type}: ${doc.storage_path}`);
  });

  console.log("\n=== Checking Files in Storage ===\n");

  // List files in bucket
  const { data: files, error: storageError } = await supabase.storage
    .from("pro-documents")
    .list("", { limit: 100 });

  if (storageError) {
    console.error("Error listing storage:", storageError);
    return;
  }

  console.log(`Found ${files.length} items in pro-documents bucket:`);
  files.slice(0, 20).forEach((file) => {
    console.log(`  ${file.name} (${file.id})`);
  });

  console.log("\n=== Comparing ===\n");

  // Check if storage_path exists in storage
  const docPath = docs[0]?.storage_path;
  if (docPath) {
    console.log(`Checking if "${docPath}" exists in storage...`);
    const { data: file, error: checkError } = await supabase.storage
      .from("pro-documents")
      .getMetadata(docPath);

    if (checkError) {
      console.log(`❌ NOT FOUND: ${checkError.message}`);
    } else {
      console.log(`✅ FOUND: Size ${file.metadata.size} bytes`);
    }
  }
}

debug().catch(console.error);
