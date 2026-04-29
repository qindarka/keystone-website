<?php
/**
 * Chatbot widget loader.
 *
 * The chatbot lives in the Cloudflare Worker (Anthropic + Resend + KV are
 * already wired up there). This file just enqueues the bundled widget JS
 * on the contact page so it talks to the existing API.
 *
 * The widget reads its API base from a data attribute on the script tag,
 * so we point it at the Worker URL here. To switch hosts in the future,
 * change KEYSTONE_CHATBOT_API_BASE in wp-config.php or via a filter.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! defined( 'KEYSTONE_CHATBOT_API_BASE' ) ) {
	define( 'KEYSTONE_CHATBOT_API_BASE', 'https://keystone-website.keystonetech.workers.dev' );
}

add_action( 'wp_enqueue_scripts', function () {
	if ( ! keystone_is_contact_page() ) return;

	$api_base = apply_filters( 'keystone_chatbot_api_base', KEYSTONE_CHATBOT_API_BASE );

	wp_enqueue_script(
		'keystone-chatbot',
		KEYSTONE_URL . '/assets/js/chatbot.js',
		[],
		KEYSTONE_VERSION,
		true
	);

	// Pass the API base into the widget via a data attribute on the script tag.
	add_filter( 'script_loader_tag', function ( $tag, $handle ) use ( $api_base ) {
		if ( $handle !== 'keystone-chatbot' ) return $tag;
		return str_replace(
			' src=',
			' data-api="' . esc_attr( $api_base ) . '" data-page="contact" src=',
			$tag
		);
	}, 10, 2 );
}, 20 );

/**
 * The contact page can be a) a Page with slug "contact", or b) a Page
 * configured via Settings → Reading. We treat both as the chatbot host.
 */
function keystone_is_contact_page() {
	if ( is_page( 'contact' ) ) return true;
	if ( is_page() ) {
		$post = get_queried_object();
		if ( $post && property_exists( $post, 'post_name' ) && $post->post_name === 'contact' ) {
			return true;
		}
	}
	return false;
}
