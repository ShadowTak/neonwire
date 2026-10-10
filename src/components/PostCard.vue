<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import UserAvatar from './UserAvatar.vue'
import { api } from '../api.js'
import { auth, token } from '../store.js'
import { toast } from '../toast.js'
import { compact, timeAgo } from '../utils.js'

const props = defineProps({
  post: { type: Object, required: true },
  showComments: { type: Boolean, default: false },
})

const emit = defineEmits(['changed', 'removed'])

const editing = ref(false)
const draft = ref('')
const commentDraft = ref('')
const open = ref(props.showComments)
const busy = ref('')
const confirmingDelete = ref(false)

const isMine = computed(() => auth.user?.id === props.post.author.id)
const wasEdited = computed(() => {
  if (!props.post.updatedAt || !props.post.createdAt) return false
  return new Date(props.post.updatedAt).getTime() - new Date(props.post.createdAt).getTime() > 1500
})

async function toggleLike() {
  if (busy.value) return
  busy.value = 'like'
  try {
    const data = props.post.likedByMe
      ? await api.unlike(token(), props.post.id)
      : await api.like(token(), props.post.id)
    emit('changed', data.post)
  } catch (error) {
    toast.error(error.message)
  } finally {
    busy.value = ''
  }
}

async function submitComment() {
  const content = commentDraft.value.trim()
  if (!content || busy.value) return
  busy.value = 'comment'
  try {
    const data = await api.comment(token(), props.post.id, content)
    emit('changed', data.post)
    commentDraft.value = ''
    open.value = true
  } catch (error) {
    toast.error(error.message)
  } finally {
    busy.value = ''
  }
}

async function removeComment(id) {
  busy.value = `comment-${id}`
  try {
    const data = await api.deleteComment(token(), id)
    emit('changed', data.post)
    toast.ok('ลบความคิดเห็นแล้ว')
  } catch (error) {
    toast.error(error.message)
  } finally {
    busy.value = ''
  }
}

function startEdit() {
  draft.value = props.post.content
  editing.value = true
}

async function saveEdit() {
  const content = draft.value.trim()
  if (!content || busy.value) return
  busy.value = 'edit'
  try {
    const data = await api.updatePost(token(), props.post.id, content)
    emit('changed', data.post)
    editing.value = false
    toast.ok('บันทึกการแก้ไขแล้ว')
  } catch (error) {
    toast.error(error.message)
  } finally {
    busy.value = ''
  }
}

async function removePost() {
  busy.value = 'delete'
  try {
    await api.deletePost(token(), props.post.id)
    emit('removed', props.post.id)
    toast.ok('ลบโพสต์แล้ว')
  } catch (error) {
    toast.error(error.message)
  } finally {
    busy.value = ''
    confirmingDelete.value = false
  }
}
</script>

<template>
  <article class="panel post">
    <header class="post-head">
      <UserAvatar :name="post.author.username" :accent="post.author.accent" />
      <div style="flex: 1; min-width: 0">
        <RouterLink class="post-author" :to="{ name: 'user', params: { id: post.author.id } }">
          {{ post.author.username }}
        </RouterLink>
        <div class="comment-meta">
          <span class="mono dim">{{ timeAgo(post.createdAt) }}</span>
          <span v-if="wasEdited" class="badge-edit">แก้ไขแล้ว</span>
        </div>
      </div>
      <span v-if="isMine" class="mono dim">// ของฉัน</span>
    </header>

    <template v-if="editing">
      <textarea v-model="draft" class="textarea" maxlength="500" rows="4" />
      <div class="composer-head" style="margin-top: 12px">
        <span class="counter" :class="{ over: draft.length > 500 }">{{ draft.length }}/500</span>
        <span style="display: flex; gap: 8px">
          <button class="btn btn-ghost btn-sm" type="button" @click="editing = false">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" type="button" :disabled="busy === 'edit'" @click="saveEdit">
            {{ busy === 'edit' ? 'กำลังบันทึก…' : 'บันทึก' }}
          </button>
        </span>
      </div>
    </template>

    <p v-else class="post-body">{{ post.content }}</p>

    <div v-if="!editing" class="post-actions">
      <button class="act" :class="{ liked: post.likedByMe }" type="button" :disabled="busy === 'like'" @click="toggleLike">
        <span>{{ post.likedByMe ? '♥' : '♡' }}</span>
        <span>{{ compact(post.likeCount) }}</span>
      </button>

      <button class="act" :class="{ on: open }" type="button" @click="open = !open">
        <span>💬</span>
        <span>{{ compact(post.commentCount) }}</span>
      </button>

      <span style="flex: 1" />

      <template v-if="isMine">
        <template v-if="confirmingDelete">
          <span class="mono dim">ลบเลยไหม?</span>
          <button class="btn btn-danger btn-sm" type="button" :disabled="busy === 'delete'" @click="removePost">
            {{ busy === 'delete' ? '…' : 'ยืนยัน' }}
          </button>
          <button class="btn btn-ghost btn-sm" type="button" @click="confirmingDelete = false">ไม่</button>
        </template>
        <template v-else>
          <button class="btn btn-ghost btn-sm" type="button" @click="startEdit">แก้ไข</button>
          <button class="btn btn-ghost btn-sm" type="button" @click="confirmingDelete = true">ลบ</button>
        </template>
      </template>
    </div>

    <section v-if="open && !editing" class="thread">
      <div v-if="!post.comments.length" class="mono dim" style="padding: 4px 0">
        ยังไม่มีความคิดเห็น — เป็นคนแรกสิ
      </div>

      <div v-for="item in post.comments" :key="item.id" class="comment">
        <UserAvatar :name="item.author.username" :accent="item.author.accent" size="sm" />
        <div class="comment-body">
          <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap">
            <RouterLink class="post-author" style="font-size: 13px" :to="{ name: 'user', params: { id: item.author.id } }">
              {{ item.author.username }}
            </RouterLink>
            <span class="mono dim">{{ timeAgo(item.createdAt) }}</span>
            <button
              v-if="auth.user?.id === item.author.id"
              class="icon-btn"
              type="button"
              title="ลบความคิดเห็น"
              :disabled="busy === `comment-${item.id}`"
              @click="removeComment(item.id)"
            >
              ✕
            </button>
          </div>
          <p class="comment-text">{{ item.content }}</p>
        </div>
      </div>

      <div class="comment-form">
        <input
          v-model="commentDraft"
          class="input"
          type="text"
          maxlength="300"
          placeholder="แสดงความคิดเห็น…"
          @keyup.enter="submitComment"
        />
        <button class="btn btn-sm" type="button" :disabled="!commentDraft.trim() || busy === 'comment'" @click="submitComment">
          {{ busy === 'comment' ? '…' : 'ส่ง' }}
        </button>
      </div>
    </section>
  </article>
</template>
