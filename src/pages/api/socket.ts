import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
};

export default function handler(_req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      socket.on("workspace:join", (projectId: string) => {
        if (projectId) socket.join(`workspace:${projectId}`);
      });

      socket.on("workspace:leave", (projectId: string) => {
        if (projectId) socket.leave(`workspace:${projectId}`);
      });

      socket.on("workspace:new-message", (payload: { projectId: string; message: unknown }) => {
        if (!payload?.projectId || !payload.message) return;
        io.to(`workspace:${payload.projectId}`).emit("workspace:new-message", payload.message);
      });

      socket.on("workspace:todo-updated", (payload: { projectId: string; todos: unknown }) => {
        if (!payload?.projectId) return;
        io.to(`workspace:${payload.projectId}`).emit("workspace:todo-updated", payload.todos);
      });

      socket.on("workspace:schedule-updated", (payload: { projectId: string; schedules: unknown }) => {
        if (!payload?.projectId) return;
        io.to(`workspace:${payload.projectId}`).emit("workspace:schedule-updated", payload.schedules);
      });

      socket.on("workspace:overview-updated", (payload: { projectId: string; overview: string }) => {
        if (!payload?.projectId) return;
        io.to(`workspace:${payload.projectId}`).emit("workspace:overview-updated", payload.overview);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}
