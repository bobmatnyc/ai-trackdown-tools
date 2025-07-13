// CLI entry point - direct execution
async function runCLI() {
  try {
    // Import main function dynamically to ensure all modules load correctly
    const { main } = await import('./index.js');
    await main();
  } catch (error) {
    console.error('CLI Error:', error instanceof Error ? error.message : String(error));
    if (process.env.DEBUG) {
      console.error(error instanceof Error ? error.stack : error);
    }
    process.exit(1);
  }
}

// Execute CLI immediately
runCLI();
