
import { parseSubmission } from "../lib/etl/parse-submission";
import * as fs from "fs";

const raw = JSON.parse(fs.readFileSync("data/reference/DRC_sia_im_outsidehouse.json", "utf8"));
console.log("Total submissions in file:", raw.length);

const p = parseSubmission(raw[0], "Outside");
console.log("First submission parsed:", JSON.stringify(p, null, 2));
