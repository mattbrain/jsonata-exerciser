import React from 'react';

class ScreenshotComponent extends React.Component {
    render() {
        const { base64WebPImage } = this.props;

        return (
            <img
                src={`data:image/webp;base64,${base64WebPImage}`}
                alt="Screenshot"
                style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
            />
        );
    }
}

export default ScreenshotComponent;
