import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const rpName = '이혜원 포트폴리오 (비공개)';
const rpID = process.env.RP_ID || 'localhost';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 1. 임시로 생성해둔 master_user 정보 가져오기
  const { data: user } = await supabase.from('users').select('*').eq('username', 'master_user').single();
  if (!user) return res.status(400).json({ error: 'User not found' });

  // 2. 이미 등록된 패스키 목록 확인 (기기 중복 등록 방지)
  const { data: passkeys } = await supabase.from('passkeys').select('credential_id').eq('user_id', user.id);

  // 3. SimpleWebAuthn을 사용해 등록용 질문(Challenge) 및 설정값 생성
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.username,
    excludeCredentials: passkeys?.map(key => ({ id: key.credential_id, type: 'public-key' })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    }
  });

  // 4. 생성된 질문(Challenge)을 재사용하지 못하도록 DB에 저장
  await supabase.from('auth_challenges').insert({
    user_id: user.id,
    challenge: options.challenge,
    type: 'registration'
  });

  res.status(200).json(options);
}
