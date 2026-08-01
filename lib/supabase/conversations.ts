import type { SupabaseClient } from "@supabase/supabase-js";
import type { GiftCandidate } from "@/lib/gifts";

export type ConversationSummary = {
  id: string;
  title: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  gifts: GiftCandidate[] | null;
  letter: string | null;
};

export async function listConversations(supabase: SupabaseClient): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getConversationMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, gifts, letter")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title: string
): Promise<ConversationSummary> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title: title.slice(0, 60) })
    .select("id, title, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function insertMessage(
  supabase: SupabaseClient,
  message: {
    id: string;
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    gifts?: GiftCandidate[] | null;
    letter?: string | null;
  }
) {
  const { error } = await supabase.from("messages").insert({
    id: message.id,
    conversation_id: message.conversationId,
    role: message.role,
    content: message.content,
    gifts: message.gifts ?? null,
    letter: message.letter ?? null,
  });
  if (error) throw error;
}

export async function updateMessageGifts(
  supabase: SupabaseClient,
  messageId: string,
  gifts: GiftCandidate[]
) {
  const { error } = await supabase.from("messages").update({ gifts }).eq("id", messageId);
  if (error) throw error;
}

export async function updateMessageLetter(supabase: SupabaseClient, messageId: string, letter: string) {
  const { error } = await supabase.from("messages").update({ letter }).eq("id", messageId);
  if (error) throw error;
}

// Moves a guest's local, unsaved chat into the account the moment they log in,
// so switching from anonymous to signed-in never drops the conversation in progress.
export async function importConversation(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    gifts?: GiftCandidate[] | null;
    letter?: string | null;
  }[]
): Promise<ConversationSummary> {
  const conversation = await createConversation(supabase, userId, title);

  for (const m of messages) {
    await insertMessage(supabase, {
      id: m.id,
      conversationId: conversation.id,
      role: m.role,
      content: m.content,
      gifts: m.gifts ?? null,
      letter: m.letter ?? null,
    });
  }

  return conversation;
}

export async function deleteConversation(supabase: SupabaseClient, conversationId: string) {
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw error;
}

