<?php

namespace Automattic\WooCommerce\Admin\Blocks;

/**
 * AbstractBlock class.
 */
abstract class AbstractBlock {

	/**
	 * Block namespace.
	 *
	 * @var string
	 */
	protected $namespace = 'woocommerce';

	/**
	 * Block name within this namespace.
	 *
	 * @var string
	 */
	protected $block_name = '';

    /**
	 * Block asset API.
	 *
	 * @var BlockAssetApi
	 */
	protected $package;

    /**
	 * Block build path.
	 *
	 * @var string
	 */
	protected $block_build_path = 'blocks/';

    /**
	 * Registered block.
	 *
	 * @var WP_Block_Type
	 */
	protected $registered_block;

	/**
	 * Constructor.
	 */
	public function __construct( $package ) {
        $this->package = $package;
		$this->init();
	}

	/**
	 * Initialize this block type.
	 */
	protected function init() {
		if ( empty( $this->block_name ) ) {
			wc_doing_it_wrong( __METHOD__, esc_html__( 'Block name is required.', 'woocommerce' ), '8.1.0' );
			return false;
		}
		// $this->register_block_type_assets();
		add_action( 'init', [ $this, 'register_block_type' ] );
	}

    /**
	 * Get the block type.
	 *
	 * @return string
	 */
	protected function get_block_type() {
		return $this->namespace . '/' . $this->block_name;
	}

    /**
	 * Get the path to a block's metadata
	 *
	 * @param string $block_name The block to get metadata for.
	 * @param string $path Optional. The path to the metadata file inside the 'build' folder.
	 *
	 * @return string|boolean False if metadata file is not found for the block.
	 */
	public function get_block_metadata_path( $block_name, $path = '' ) {
        $plugin_directory = plugin_basename(__FILE__);

		$metadata_path = $this->package->get_build_path( $this->block_build_path ) . $block_name . '/block.json';

		if ( ! file_exists( $metadata_path ) ) {
			return false;
		}
		return $metadata_path;
	}


	/**
	 * Registers the block type with WordPress.
	 *
	 * @return string[] Chunks paths.
	 */
	public function register_block_type() {
		$metadata_path = $this->get_block_metadata_path( $this->block_name );

		if ( empty( $metadata_path ) ) {
            return;
		}

        $this->registered_block = register_block_type_from_metadata( $metadata_path );

        return $this->registered_block;
	}

    /**
     * Enqueue block scripts and styles.
     */
    public function enqueue_block_scripts_and_styles() {
        if ( ! $this->registered_block ) {
            throw new \Exception( 'Block has not yet been registered.' );
            return;
        }

        $script_handles = $this->registered_block->editor_script_handles;
        $style_handles  = $this->registered_block->editor_style_handles;

        foreach ( $script_handles as $handle ) {
            wp_enqueue_script( $handle );
        }

        foreach ( $style_handles as $handle ) {
            wp_enqueue_style( $handle );
        }
    }

}
