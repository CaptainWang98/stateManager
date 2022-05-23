<script lang="ts">
import { defineComponent } from "vue";
import { useQuery } from "../../../src/useQuery";

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
    const { isLoading, isError, isFetching, data, error } = useQuery(
      ["post", props.postId],
      () => fetcher(props.postId)
    );

    return { isLoading, isError, isFetching, data, error };
  },
});
</script>

<template>
  <h1>Post {{ postId }}</h1>
  <a @click="$emit('setPostId', -1)" href="#"> Back </a>
  <div v-if="isLoading" class="update">LOADING~</div>
  <div v-else-if="isError">ERROR: {{ error }}</div>
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
