<?php
/**
 * Keystone theme bootstrap.
 *
 * Block theme — most behavior is declarative (theme.json + templates + parts).
 * This file is for: theme supports, custom post types, asset enqueueing,
 * and the chatbot hook.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'KEYSTONE_VERSION', '1.0.0' );
define( 'KEYSTONE_DIR', get_stylesheet_directory() );
define( 'KEYSTONE_URL', get_stylesheet_directory_uri() );

require_once KEYSTONE_DIR . '/inc/post-types.php';
require_once KEYSTONE_DIR . '/inc/patterns.php';
require_once KEYSTONE_DIR . '/inc/chatbot.php';
require_once KEYSTONE_DIR . '/inc/shortcodes.php';
require_once KEYSTONE_DIR . '/inc/demo-import.php';
require_once KEYSTONE_DIR . '/inc/dates-fix.php';

// ---- Theme supports & cleanup -------------------------------------------

add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'editor-styles' );
	add_theme_support( 'html5', [ 'search-form', 'comment-form', 'gallery', 'caption', 'style', 'script' ] );

	// Custom logo (Keystone SVG).
	add_theme_support( 'custom-logo', [
		'height'      => 42,
		'width'       => 200,
		'flex-width'  => true,
		'flex-height' => true,
	] );

	register_nav_menus( [
		'primary' => __( 'Primary Navigation', 'keystone' ),
		'footer'  => __( 'Footer Navigation', 'keystone' ),
	] );
} );

// ---- Asset enqueue ------------------------------------------------------

add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'keystone-style',
		get_stylesheet_uri(),
		[],
		KEYSTONE_VERSION
	);

	// Site styles, copied from the static site for visual parity.
	wp_enqueue_style(
		'keystone-site',
		KEYSTONE_URL . '/assets/css/styles.css',
		[],
		KEYSTONE_VERSION
	);

	// Reveal-on-scroll + nav toggle, copied from the static site.
	wp_enqueue_script(
		'keystone-main',
		KEYSTONE_URL . '/assets/js/main.js',
		[],
		KEYSTONE_VERSION,
		true
	);

	// Google Fonts.
	wp_enqueue_style(
		'keystone-fonts',
		'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap',
		[],
		null
	);
} );

// Editor styles so the block editor matches the front end.
add_action( 'after_setup_theme', function () {
	add_editor_style( [
		'assets/css/styles.css',
		'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap',
	] );
} );

// ---- Misc: hide the WP admin bar on the front for non-admins ----------

add_action( 'after_setup_theme', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		show_admin_bar( false );
	}
} );

// ---- Disable comments site-wide (marketing site, no community) -------

add_action( 'admin_init', function () {
	$post_types = get_post_types();
	foreach ( $post_types as $post_type ) {
		if ( post_type_supports( $post_type, 'comments' ) ) {
			remove_post_type_support( $post_type, 'comments' );
			remove_post_type_support( $post_type, 'trackbacks' );
		}
	}
} );

add_filter( 'comments_open',     '__return_false', 20, 2 );
add_filter( 'pings_open',        '__return_false', 20, 2 );
add_filter( 'comments_array',    '__return_empty_array', 10, 2 );
