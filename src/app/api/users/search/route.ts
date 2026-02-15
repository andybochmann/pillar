import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email || email.length < 2) {
    return NextResponse.json([]);
  }

  await connectDB();

  const users = await User.find(
    {
      email: { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
      _id: { $ne: session.user.id },
    },
    { _id: 1, name: 1, email: 1, image: 1 },
  )
    .limit(10)
    .lean();

  const serialized = users.map((u) => ({
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    image: u.image,
  }));

  return NextResponse.json(serialized);
}
