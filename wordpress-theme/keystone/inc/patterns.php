<?php
/**
 * Block pattern registration.
 *
 * Patterns live as .php files in /patterns/ (auto-discovered by WP since 6.0
 * via the file header). This file just registers the "keystone" pattern
 * category so they group nicely in the inserter.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'init', function () {
	register_block_pattern_category(
		'keystone',
		[ 'label' => __( 'Keystone', 'keystone' ) ]
	);
} );
