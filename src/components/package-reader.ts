import appRootPath from "app-root-path";
import fs from "fs";

const buf = await fs.promises.readFile(`${appRootPath.path}/package.json`);
const packageInfo = JSON.parse(buf.toString("utf-8"));

export default packageInfo;
