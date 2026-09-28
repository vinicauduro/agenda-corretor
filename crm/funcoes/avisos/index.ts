// Função "avisos" do Supabase (Edge Function). Roda a cada minuto, chamada pelo
// agendador (crm/avisos.sql): pergunta ao banco quais lembretes e compromissos
// venceram e manda o push para os aparelhos inscritos, mesmo com o app fechado.
//
// As chaves do push (VAPID) são criadas aqui no primeiro uso e guardadas em
// crm_config; o app pega a pública pela função crm_vapid_publica().
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
});

type Vapid = { publica: string; privada: string };

async function chavesVapid(): Promise<Vapid> {
  const { data } = await sb.from('crm_config').select('valor').eq('chave', 'vapid').maybeSingle();
  if (data?.valor?.publica) return data.valor as Vapid;
  const k = webpush.generateVAPIDKeys();
  const valor = { publica: k.publicKey, privada: k.privateKey };
  const { error } = await sb.from('crm_config').insert({ chave: 'vapid', valor });
  if (!error) return valor;
  // outra execução criou ao mesmo tempo: vale a que ficou no banco
  const { data: salvo } = await sb.from('crm_config').select('valor').eq('chave', 'vapid').single();
  return salvo!.valor as Vapid;
}

Deno.serve(async (req) => {
  const { data: cron } = await sb.from('crm_config').select('valor').eq('chave', 'cron').maybeSingle();
  if (!cron?.valor?.segredo || req.headers.get('x-cron-segredo') !== cron.valor.segredo) {
    return new Response('proibido', { status: 403 });
  }

  const vapid = await chavesVapid();
  webpush.setVapidDetails('https://vinicauduro.github.io/agenda-corretor/', vapid.publica, vapid.privada);

  const { data: avisos, error } = await sb.rpc('crm_avisos_a_enviar');
  if (error) return new Response(error.message, { status: 500 });

  let enviados = 0;
  const vencidas: string[] = [];
  for (const a of avisos ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify({ titulo: a.titulo, corpo: a.corpo, tag: a.tag }),
        { TTL: 3600 }
      );
      enviados++;
    } catch (e) {
      // 404/410: o aparelho cancelou a inscrição (desinstalou, tirou a permissão)
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) vencidas.push(a.endpoint);
      else console.error('push falhou', status, String(e));
    }
  }
  if (vencidas.length) await sb.from('push_inscricoes').delete().in('endpoint', vencidas);

  return Response.json({ avisos: avisos?.length ?? 0, enviados, removidas: vencidas.length });
});
