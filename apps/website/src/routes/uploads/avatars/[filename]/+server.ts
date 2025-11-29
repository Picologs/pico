import type { RequestHandler } from './$types';
import { handleAvatarServe } from '@pico/shared/server';
import path from 'node:path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'avatars');

export const GET: RequestHandler = async ({ params }) => {
	const { filename } = params;

	const result = await handleAvatarServe(filename, { uploadDir: UPLOAD_DIR });

	if (!result.success) {
		return new Response(result.error, { status: result.status });
	}

	return new Response(result.body as BodyInit, {
		headers: result.headers
	});
};
