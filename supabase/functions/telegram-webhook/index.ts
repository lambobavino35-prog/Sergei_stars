// ══════════════════════════════════════════════════════════════
//  TELEGRAM WEBHOOK
//  Supabase Edge Function (Deno runtime).
//
//  Telegram шлёт POST-запрос на этот URL каждый раз, когда
//  пользователь пишет боту. Мы обрабатываем:
//    /start  → добавляем chat_id в sq_telegram_subscribers
//    /stop   → удаляем chat_id
//    /whoami → отвечаем текущим chat_id
//
//  Токен бота НЕ нужен для приёма — webhook просто читает входящие.
//  Для ОТПРАВКИ ответов пользователю (подтверждений) токен нужен
//  и читается из переменной окружения TELEGRAM_BOT_TOKEN.
//
//  Установи webhook в Telegram один раз после деплоя:
//    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<FUNCTION_URL>"
// ══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendReply(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("sendReply error:", e);
  }
}

Deno.serve(async (req) => {
  // Только POST от Telegram
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  let update;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const msg = update?.message;
  if (!msg || !msg.chat || !msg.text) {
    return new Response("OK", { status: 200 });
  }

  const chatId = msg.chat.id;
  const username = msg.chat.username ?? null;
  const firstName = msg.chat.first_name ?? null;
  const text = msg.text.trim();

  try {
    if (text === "/start") {
      // upsert — если уже подписан, просто обновим имя/username
      const { error } = await supabase
        .from("sq_telegram_subscribers")
        .upsert({
          chat_id: chatId,
          username,
          first_name: firstName,
        });

      if (error) {
        console.error("upsert error:", error);
        await sendReply(chatId, "⚠️ Что-то пошло не так. Попробуй позже.");
      } else {
        await sendReply(
          chatId,
          `✅ Подписка активна!\n\nТеперь ты будешь получать уведомления из Sergei Quest.\n\nКоманды:\n/stop — отписаться\n/whoami — показать твой chat_id`
        );
      }
    } else if (text === "/stop") {
      const { error } = await supabase
        .from("sq_telegram_subscribers")
        .delete()
        .eq("chat_id", chatId);

      if (error) {
        console.error("delete error:", error);
        await sendReply(chatId, "⚠️ Что-то пошло не так.");
      } else {
        await sendReply(chatId, "👋 Ты отписан. Чтобы вернуться — напиши /start");
      }
    } else if (text === "/whoami") {
      await sendReply(
        chatId,
        `<b>Твой chat_id:</b> <code>${chatId}</code>\n<b>Username:</b> ${username ? "@" + username : "—"}`
      );
    } else if (text === "/help") {
      await sendReply(
        chatId,
        "Команды:\n/start — подписаться на уведомления\n/stop — отписаться\n/whoami — показать chat_id"
      );
    } else {
      // Любое другое сообщение — игнорируем или отвечаем подсказкой
      await sendReply(chatId, "Я понимаю только команды. Напиши /help");
    }
  } catch (e) {
    console.error("Handler error:", e);
  }

  // Telegram ожидает 200 OK — иначе повторит запрос
  return new Response("OK", { status: 200 });
});
