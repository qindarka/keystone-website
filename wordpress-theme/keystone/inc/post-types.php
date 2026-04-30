<?php
/**
 * Custom post types and taxonomies.
 *
 *  - service (8 service detail pages, individuals at /services/<slug>/)
 *  - post    (built-in, used for ~50 knowledge articles, with category "Knowledge")
 *
 * /services/ itself is a regular WP Page (with the nice navy-hero +
 * service-cards overview). The CPT does NOT register an archive at
 * /services/ — that would override the Page.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'init', function () {
	register_post_type( 'service', [
		'labels' => [
			'name'               => __( 'Services',       'keystone' ),
			'singular_name'      => __( 'Service',        'keystone' ),
			'add_new'            => __( 'Add New',        'keystone' ),
			'add_new_item'       => __( 'Add New Service','keystone' ),
			'edit_item'          => __( 'Edit Service',   'keystone' ),
			'new_item'           => __( 'New Service',    'keystone' ),
			'view_item'          => __( 'View Service',   'keystone' ),
			'search_items'       => __( 'Search Services','keystone' ),
			'menu_name'          => __( 'Services',       'keystone' ),
			'all_items'          => __( 'All Services',   'keystone' ),
		],
		'public'              => true,
		'has_archive'         => false,
		'rewrite'             => [ 'slug' => 'services', 'with_front' => false ],
		'show_in_rest'        => true,
		'menu_position'       => 21,
		'menu_icon'           => 'dashicons-screenoptions',
		'supports'            => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields' ],
		'template'            => [
			[ 'core/pattern', [ 'slug' => 'keystone/service-detail' ] ],
		],
	] );

	// Make sure the "Knowledge" category exists for articles.
	if ( ! term_exists( 'Knowledge', 'category' ) ) {
		wp_insert_term( 'Knowledge', 'category', [ 'slug' => 'knowledge' ] );
	}
} );

// Permalink rewrite: individual articles in the Knowledge category live at
// /knowledge/<slug>/. We don't claim /knowledge/ itself — that's a real
// WP Page (with the navy hero + [keystone_knowledge_grid] shortcode) so
// users can edit the page intro in the editor.
add_action( 'init', function () {
	add_rewrite_rule(
		'^knowledge/([^/]+)/?$',
		'index.php?name=$matches[1]',
		'top'
	);
} );

// Category base "knowledge" prefix for posts in the Knowledge category.
// (Posts in other categories keep the default permalink structure.)
add_filter( 'post_link', function ( $url, $post ) {
	if ( $post->post_type !== 'post' ) return $url;
	$cats = wp_get_post_categories( $post->ID );
	foreach ( $cats as $cat_id ) {
		$cat = get_category( $cat_id );
		if ( $cat && $cat->slug === 'knowledge' ) {
			return home_url( '/knowledge/' . $post->post_name . '/' );
		}
	}
	return $url;
}, 10, 2 );

// Flush rewrite rules on theme activation so /services/ and /knowledge/ start working.
add_action( 'after_switch_theme', function () {
	flush_rewrite_rules();
} );
