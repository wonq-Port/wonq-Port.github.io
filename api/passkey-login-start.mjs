import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const rpID = process.env.RP_ID || 'localhost';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 로그인용 질문(Challenge) 생성
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  });

  await supabase.from('auth_challenges').insert({
    challenge: options.challenge,
    type: 'authentication'
  });

  res.status(200).json(options);
}
