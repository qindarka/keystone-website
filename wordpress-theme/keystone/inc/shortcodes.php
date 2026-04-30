<?php
/**
 * Theme shortcodes.
 *
 *  [keystone_knowledge_grid]
 *      Renders all "Knowledge" category posts as a grid of <a class="kn-card">
 *      elements — same markup the static site used at /knowledge/, so the
 *      bundled CSS just works. Auto-picks up any new article you publish.
 *
 *  Optional attributes:
 *      limit   max posts (default: -1 = all)
 *      orderby 'date' (default) or any wp_query orderby
 *      order   'DESC' (default) or 'ASC'
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_shortcode( 'keystone_knowledge_grid', function ( $atts ) {
	$atts = shortcode_atts( [
		'limit'   => -1,
		'orderby' => 'date',
		'order'   => 'DESC',
	], $atts );

	$posts = get_posts( [
		'category_name' => 'knowledge',
		'numberposts'   => (int) $atts['limit'],
		'orderby'       => $atts['orderby'],
		'order'         => $atts['order'],
		'post_status'   => 'publish',
	] );

	if ( empty( $posts ) ) {
		return '<p style="text-align:center;color:#4a5a6e;">No articles yet.</p>';
	}

	$out = '<div class="kn-grid">';
	foreach ( $posts as $p ) {
		$slug = $p->post_name;
		$href = esc_url( get_permalink( $p ) );
		$title = esc_html( $p->post_title );

		// Image: prefer WP featured image, otherwise the static-site
		// thumbnail bundled with the theme. Try common extensions.
		$img = get_the_post_thumbnail_url( $p->ID, 'medium_large' );
		if ( ! $img ) {
			$base = KEYSTONE_DIR . '/assets/images/knowledge/' . $slug;
			$base_url = KEYSTONE_URL . '/assets/images/knowledge/' . $slug;
			foreach ( [ '.jpg', '.jpeg', '.png', '.webp' ] as $ext ) {
				if ( file_exists( $base . $ext ) ) {
					$img = $base_url . $ext;
					break;
				}
			}
		}

		// Excerpt: use the post excerpt, or trim the content.
		$excerpt = $p->post_excerpt;
		if ( ! $excerpt ) {
			$excerpt = wp_trim_words( wp_strip_all_tags( $p->post_content ), 28, '' );
		}

		$date = mysql2date( 'F j, Y', $p->post_date );

		$out .= '<a class="kn-card reveal" href="' . $href . '">';
		if ( $img ) {
			$out .= '<div class="kn-card-img"><img src="' . esc_url( $img ) . '" alt="' . esc_attr( $p->post_title ) . '" loading="lazy" /></div>';
		}
		$out .= '<div class="kn-card-body">';
		$out .= '<span class="kn-card-date">' . esc_html( $date ) . '</span>';
		$out .= '<h3>' . $title . '</h3>';
		$out .= '<p>' . esc_html( $excerpt ) . '</p>';
		$out .= '<span class="kn-card-more">Read article</span>';
		$out .= '</div></a>';
	}
	$out .= '</div>';

	return $out;
} );
