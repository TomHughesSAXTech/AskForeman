module.exports = async function (context, req) {
    context.res = {
        status: 200,
        body: {
            message: "Pong!",
            timestamp: new Date().toISOString(),
            nodeVersion: process.version
        }
    };
};
