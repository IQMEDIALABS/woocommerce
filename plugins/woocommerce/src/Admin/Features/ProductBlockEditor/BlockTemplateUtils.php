<?php

namespace Automattic\WooCommerce\Admin\Features\ProductBlockEditor;

use Automattic\WooCommerce\LayoutTemplates\LayoutTemplateRegistry;

class BlockTemplateUtils {

    /**
	 * Directory which contains all templates
	 *
	 * @var string
	 */
	const TEMPLATES_ROOT_DIR = 'templates';

    /**
     * Directory names.
     *
     * @var array
     */
    const DIRECTORY_NAMES = [
        'TEMPLATES' => 'product-editor',
        'TEMPLATE_PARTS' => 'product-editor/parts'
    ];

    /**
     * Area
     *
     * @var string
     */
    const AREA = 'product-form';

	/**
	 * WooCommerce plugin slug
	 *
	 * @var string
	 */
	const PLUGIN_SLUG = 'woocommerce/woocommerce';

    /**
     * Get all the template paths in a given directory.
     *
     * @param string $directory Directory path.
     * @return array Array of file paths.
     */
    private function get_template_paths( $directory ) {
        return glob( $directory . '/*.html' );
    }

    /**
	 * Converts template paths into a slug
	 *
	 * @param string $path The template's path.
	 * @return string slug
	 */
	private function generate_template_slug_from_path( $path ) {
		$template_extension = '.html';

		return basename( $path, $template_extension );
	}

    /**
	 * Gets the directory where templates of a specific template type can be found.
	 *
	 * @param string $template_type wp_template or wp_template_part.
	 * @return string
	 */
    private function get_templates_directory( $template_type = 'wp_template' ) {
        $root_path                = dirname( __DIR__, 4 ) . '/' . self::TEMPLATES_ROOT_DIR . DIRECTORY_SEPARATOR;
        $templates_directory      = $root_path . self::DIRECTORY_NAMES['TEMPLATES'];
        $template_parts_directory = $root_path . self::DIRECTORY_NAMES['TEMPLATE_PARTS'];

        if ( 'wp_template_part' === $template_type ) {
            return $template_parts_directory;
        }

        return $templates_directory;
    }


    /**
     * Get all the block templates from the directory by type.
     *
	 * @param string $template_type wp_template or wp_template_part.
	 * @param array  $query Optional. Arguments to retrieve templates.
     */
    public function get_block_templates( $template_type, $query ) {
        $directory      = $this->get_templates_directory( $template_type );
		$template_files = $this->get_template_paths( $directory );

        $slugs          = $query['slug__in'] ?? [];
		$templates      = array();

		foreach ( $template_files as $template_file ) {
			$template_slug = $this->generate_template_slug_from_path( $template_file );

			// This template does not have a slug we're looking for. Skip it.
			if ( is_array( $slugs ) && count( $slugs ) > 0 && ! in_array( $template_slug, $slugs, true ) ) {
				continue;
			}

			$templates[] = $this->create_new_block_template( $template_file, $template_type, $template_slug );
		}

		return $templates;
    }

    /**
	 * Build a new template based on the filepath.
	 *
	 * @param string $template_file Block template file path.
	 * @param string $template_type wp_template or wp_template_part.
	 * @param string $template_slug Block template slug e.g. single-product.
	 * @return object Block template object.
	 */
	private function create_new_block_template( $template_file, $template_type, $template_slug ) {
        $template                 = new \WP_Block_Template();
        $template->id             = self::PLUGIN_SLUG . '//' . $template_slug;
        $template->theme          = self::PLUGIN_SLUG;
        $template->content        = file_get_contents( $template_file );
        $template->slug           = $template_slug;
        $template->source         = 'plugin';
        $template->area           = self::AREA;
        $template->type           = $template_type;
        $template->title          = $this->get_block_template_title( $template_slug );
        $template->description    = $this->get_block_template_description( $template_slug );
        $template->status         = 'publish';
        $template->has_theme_file = false;
        $template->is_custom      = false;
        $template->modified       = null;

        $before_block_visitor = '_inject_theme_attribute_in_template_part_block';
        $after_block_visitor  = null;
        $hooked_blocks        = get_hooked_blocks();
        if ( ! empty( $hooked_blocks ) || has_filter( 'hooked_block_types' ) ) {
            $before_block_visitor = make_before_block_visitor( $hooked_blocks, $template, array( $this, 'insert_blocks' ) );
            $after_block_visitor  = make_after_block_visitor( $hooked_blocks, $template, array( $this, 'insert_blocks' ) );
        }
        $blocks            = parse_blocks( $template->content );
        $template->content = traverse_and_serialize_blocks( $blocks, $before_block_visitor, $after_block_visitor );

		return $template;
	}

    /**
     * Returns the markup for blocks hooked to the given anchor block in a specific relative position.
     *
     * @since 6.5.0
     * @access private
     *
     * @param array                   $parsed_anchor_block The anchor block, in parsed block array format.
     * @param string                  $relative_position   The relative position of the hooked blocks.
     *                                                     Can be one of 'before', 'after', 'first_child', or 'last_child'.
     * @param array                   $hooked_blocks       An array of hooked block types, grouped by anchor block and relative position.
     * @param WP_Block_Template|array $context             The block template, template part, or pattern that the anchor block belongs to.
     * @return string
     */
    public function insert_blocks( &$parsed_anchor_block, $relative_position, $hooked_blocks, $context ) {
        /**
         * Filters the list of inserted blocks for a given anchor block type and relative position.
         *
         * @param array[]                         $inserted_blocks     The list of inserted blocks.
         * @param string                          $parsed_anchor_block The parsed anchor block.
         * @param string                          $relative_position   The relative position of the hooked blocks.
         *                                                             Can be one of 'before', 'after', 'first_child', or 'last_child'.
         * @param WP_Block_Template|WP_Post|array $context             The block template, template part, `wp_navigation` post type,
         *                                                             or pattern that the anchor block belongs to.
         */
        $inserted_blocks = apply_filters( "inserted_blocks", array(), $parsed_anchor_block, $relative_position, $context );

        $markup = '';
        foreach ( $inserted_blocks as $inserted_block ) {
            $parsed_inserted_block = array(
                'blockName'    => $inserted_block['blockName'] ?? '',
                'attrs'        => $inserted_block['attrs'] ?? array(),
                'innerBlocks'  => $inserted_block['innerBlocks'] ?? array(),
                'innerContent' => $inserted_block['innerContent'] ?? array(),
            );

            // Parse these first so markup is generated from all inner blocks.
            $first_chunk = $this->insert_blocks( $parsed_inserted_block, 'first_child', $hooked_blocks, $context );
            $last_chunk  = $this->insert_blocks( $parsed_inserted_block, 'last_child', $hooked_blocks, $context );
            array_unshift( $parsed_inserted_block['innerContent'], $first_chunk );
            array_push( $parsed_inserted_block['innerContent'], $last_chunk );

            // Prepend with blocks inserted before, serialize this block, and append with blocks inserted after.
            $markup .= $this->insert_blocks( $parsed_inserted_block, 'before', $hooked_blocks, $context );
            $markup .= serialize_block( $parsed_inserted_block );
            $markup .= $this->insert_blocks( $parsed_inserted_block, 'after', $hooked_blocks, $context );
        }

        return $markup;
    }

    /**
     * Get the block template title.
     *
     * @param string $template_slug Template slug.
     * @return string Template title.
     */
    private function get_block_template_title( $template_slug ) {
		$layout_template_registry = wc_get_container()->get( LayoutTemplateRegistry::class );
        $product_templates        = $layout_template_registry->instantiate_layout_templates();
        $product_template         = $product_templates[ $template_slug ] ?? null;

        if ( $product_template ) {
            return $product_template->get_title();
        }

        return ucwords( preg_replace( '/[\-_]/', ' ', $template_slug ) );
    }

    /**
     * Get the block template description.
     *
     * @param string $template_slug Template slug.
     * @return string Template description.
     */
    private function get_block_template_description( $template_slug ) {
		$layout_template_registry = wc_get_container()->get( LayoutTemplateRegistry::class );
        // @TODO The layout template registry might need a new name and a getter or a separate class altogether.
        $product_templates        = $layout_template_registry->instantiate_layout_templates();
        $product_template         = $product_templates[ $template_slug ] ?? null;

        if ( $product_template ) {
            return $product_template->get_description();
        }

        return '';
    }

    /**
     * Get additional data related to the template.
     */
    public function get_block_template_additional_data( $template_slug ) {
        $layout_template_registry = wc_get_container()->get( LayoutTemplateRegistry::class );
        $product_templates        = $layout_template_registry->instantiate_layout_templates();
        $product_template         = $product_templates[ $template_slug ] ?? null;
        
        if ( ! $product_template ) {
            return array();
        }

        return array(
            'product_types'        => $product_template->get_compatible_product_types(),
            'default_product_data' => $product_template->get_default_product_data()
        );
    }

}