// Schedule small batches so the interface stays responsive.
function scheduleBatch(entries: string[], delay: number) {
  const batch = entries.slice(0, 3);

  // Names get color here, where they are introduced.
  function publish(label: string) {
    console.log(label, batch.length);
  }

  setTimeout(() => {
    publish("Ready");
  }, delay);

  return batch;
}

const messages = ["Draft", "Review", "Publish"];
const result = scheduleBatch(messages, 250);
console.log(result);
