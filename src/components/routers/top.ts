import appRootPath from "app-root-path";
import fastify from "fastify";
import fs from "fs";

export default async function topRouter(req: fastify.FastifyRequest, res: fastify.FastifyReply) {
    const response = await fs.promises.readFile(`${appRootPath.path}/src/components/top-page/page.html`);
    res.status(200);
    res.type("text/html");
    return res.send(response);
}
