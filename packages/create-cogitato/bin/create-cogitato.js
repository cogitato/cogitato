#!/usr/bin/env node
import { main } from "../dist/create.js";

process.exitCode = await main(process.argv.slice(2));
