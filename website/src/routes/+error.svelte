<script lang="ts">
	import { page } from '$app/state';
</script>

<main id="main-content" class="wrap py-24">
	<h1>{page.status === 404 ? 'No such page.' : 'Something went wrong.'}</h1>
	<p class="mt-5"><a href="/">Back to the front door</a></p>
</main>
