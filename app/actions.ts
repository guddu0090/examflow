"use server"

import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"
import { cookies } from "next/headers"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-key-for-dev")

export async function loginUser(email: any, password: any) {
  const user = await db.user.findUnique({ where: { email }, include: { enrollments: true } })
  if (!user) return { error: "User not found" }
  if (user.password !== password) return { error: "Invalid password" } 
  
  const token = await new SignJWT({ id: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET)
    
  const cookieStore = await cookies();
  cookieStore.set("token", token, { httpOnly: true, path: "/" })
  return { success: true, user: { ...user, classIds: user.enrollments.map((e: any) => e.classId) } }
}

export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete("token")
}

export async function registerUser(data: any) {
  const existing = await db.user.findUnique({ where: { email: data.email } })
  if (existing) return { error: "Email already exists" }

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      teacherStatus: data.role === "teacher" ? "pending" : null,
      subject: data.subject || null,
      bio: data.bio || null,
    }
  })
  return { success: true, user }
}

export async function fetchFullDB() {
  try {
    let users = await db.user.findMany({ include: { enrollments: true } });

    if (users.length === 0) {
      const admin = await db.user.create({
        data: {
          name: "Super Admin",
          email: "admin@exam.io",
          password: "admin",
          role: "superadmin",
          avatar: "SA",
        }
      });
      users = [{ ...admin, enrollments: [] }];
    }
    const classes = await db.class.findMany();
    const exams = await db.exam.findMany();
    const rawQuestions = await db.question.findMany();
    const rawAttempts = await db.attempt.findMany({ include: { cheatSummary: { include: { logs: true } } } });
    const announcements = await db.announcement.findMany();
    const classRequests = await db.classRequest.findMany();
    const cheatLogs = await db.cheatLog.findMany();

    return {
      users: users.map((u: any) => ({ ...u, classIds: u.enrollments?.map((e: any)=>e.classId) || [] })),
      classes,
      exams,
      questions: rawQuestions.map((q: any) => ({ ...q, options: JSON.parse(q.options) })),
      attempts: rawAttempts.map((a: any) => ({ ...a, answers: JSON.parse(a.answers) })),
      announcements,
      classRequests,
      cheatLogs
    }
  } catch (error: any) {
    return { error: error.message || error.toString() }
  }
}

export async function genericInsert(table: string, data: any) {
  if (table === "classes") {
    return await db.class.create({ data })
  }
  if (table === "exams") {
    return await db.exam.create({ data })
  }
  if (table === "questions") {
    return await db.question.create({ data: { ...data, options: JSON.stringify(data.options) } })
  }
  if (table === "announcements") {
    return await db.announcement.create({ data })
  }
  if (table === "classRequests") {
    return await db.classRequest.create({ data })
  }
  if (table === "attempts") {
    return await db.attempt.create({ data: { ...data, answers: JSON.stringify(data.answers) } })
  }
  if (table === "cheatLogs") {
    return await db.cheatLog.create({ data })
  }
  return null;
}

export async function mutateEntity(table: string, id: string, data: any) {
  if (table === "users") {
    if (data.classIds) {
      await db.classEnrollment.deleteMany({ where: { studentId: id } })
      await db.classEnrollment.createMany({
        data: data.classIds.map((classId: string) => ({ studentId: id, classId }))
      })
      delete data.classIds
    }
    return await db.user.update({ where: { id }, data })
  }
  if (table === "classes") return await db.class.update({ where: { id }, data })
  if (table === "classRequests") return await db.classRequest.update({ where: { id }, data })
  if (table === "exams") return await db.exam.update({ where: { id }, data })
  if (table === "questions") return await db.question.update({ where: { id }, data: { ...data, options: data.options ? JSON.stringify(data.options) : undefined } })
  throw new Error("Unknown table: " + table)
}

export async function deleteEntity(table: string, id: string) {
  if (table === "classes") return await db.class.delete({ where: { id } })
  if (table === "exams") return await db.exam.delete({ where: { id } })
  if (table === "questions") return await db.question.delete({ where: { id } })
  if (table === "announcements") return await db.announcement.delete({ where: { id } })
  throw new Error("Unknown table: " + table)
}
