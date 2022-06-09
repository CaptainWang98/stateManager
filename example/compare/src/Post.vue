<script lang="ts">
import { defineComponent, ref, type Ref } from "vue";

export interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

const fetcher = async (id: number): Promise<Post> =>
  await fetch(`https://jsonplaceholder.typicode.com/posts/${id}`).then(
    (response) => response.json()
  );

export default defineComponent({
  name: "Post",
  props: {
    postId: {
      type: Number,
      required: true,
    },
  },
  emits: ["setPostId"],
  setup(props) {
    let isFetching = ref(false)
    let isLoading = ref(false)
    let isError = ref(false)
    let data: Ref<Post> = ref({
      userId: 0,
      id: 0,
      title: 'NoTitle',
      body: 'noBody',
    })

    isFetching.value = true

    fetcher(props.postId)
    .then(res => {
      data.value = res
    })
    .catch(err => {
      isError.value = true
    })
    .finally(() => {
      isFetching.value = false
    })

    return { isLoading, isFetching, data, isError };
  },
});
</script>

<template>
  <h1>Post {{ postId }}</h1>
  <a @click="$emit('setPostId', -1)" href="#"> Back </a>
  <div v-if="isLoading" class="update">LOADING~</div>
  <div v-else-if="isError">ERROR</div>
  <div v-else-if="data">
    <h1>{{ data.title }}</h1>
    <div>
      <p>{{ data.body }}</p>
    </div>
    <div v-if="isFetching" class="update">FETCHING~</div>
  </div>
</template>

<style scoped>
.update {
  font-weight: bold;
  color: green;
}
</style>
