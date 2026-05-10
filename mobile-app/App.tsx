import React from "react";
import { ExpoRoot } from "expo-router";
import { ctx } from "expo-router/_ctx";
import { Head } from "expo-router/build/head";

export default function App() {
  return (
    <Head.Provider>
      <ExpoRoot context={ctx} />
    </Head.Provider>
  );
}
