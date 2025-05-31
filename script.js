document.addEventListener('DOMContentLoaded', () => {
    const photoGalleryContainer = document.getElementById('photo-gallery-container');
    const filterList = document.getElementById('filter-list');
    const modal = document.getElementById('photo-modal');
    const modalCloseButton = document.querySelector('.modal-close-button');

    // モーダル内の要素
    const singleImageView = document.getElementById('single-image-view');
    const modalImage = document.getElementById('modal-image');
    const sideBySideView = document.getElementById('side-by-side-view');
    const sbsAnimeImage = document.getElementById('sbs-anime-image');
    const sbsRealImage = document.getElementById('sbs-real-image');
    const toggleComparisonButton = document.getElementById('toggle-comparison-button');

    const photoDescription = document.getElementById('photo-description');
    const mapPlaceholderModal = document.getElementById('map-placeholder-modal');
    const streetviewLinkModal = document.getElementById('streetview-link-modal');

    // ダミーの写真データ
    const dummyPhotos = [
        {
            id: 1,
            realSrc: 'https://via.placeholder.com/800x600.png?text=聖地A実写',
            animeSrc: 'https://via.placeholder.com/800x600.png?text=聖地Aアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地A',
            title: '旧碓氷峠見晴台',
            animeTitle: 'anime-a',
            description: 'アニメAの第3話に登場した見晴台。素晴らしい景色が広がります。',
            lat: 36.395, lng: 138.693,
            animeTitleDisplay: 'あの夏で待ってる'
        },
        {
            id: 2,
            realSrc: 'https://via.placeholder.com/800x600.png?text=聖地B実写',
            animeSrc: 'https://via.placeholder.com/800x600.png?text=聖地Bアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地B',
            title: '本栖湖キャンプ場',
            animeTitle: 'anime-b',
            description: 'アニメBのメインビジュアルにもなったキャンプ場。富士山が綺麗。',
            lat: 35.470, lng: 138.588,
            animeTitleDisplay: 'ゆるキャン△'
        },
        {
            id: 3,
            realSrc: 'https://via.placeholder.com/800x600.png?text=聖地C実写',
            animeSrc: 'https://via.placeholder.com/800x600.png?text=聖地Cアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地C',
            title: '宇治橋',
            animeTitle: 'anime-c',
            description: 'アニメCで何度も登場する宇治の象徴的な橋です。',
            lat: 34.890, lng: 135.807,
            animeTitleDisplay: '響け！ユーフォニアム'
        },
        {
            id: 4,
            realSrc: 'https://via.placeholder.com/800x600.png?text=聖地D実写',
            animeSrc: 'https://via.placeholder.com/800x600.png?text=聖地Dアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地D',
            title: '小諸駅前',
            animeTitle: 'anime-a',
            description: 'アニメAのキャラクターたちがよく利用していた駅です。',
            lat: 36.326, lng: 138.421,
            animeTitleDisplay: 'あの夏で待ってる'
        },
        {
            id: 5,
            realSrc: 'https://via.placeholder.com/800x600.png?text=聖地E実写',
            animeSrc: 'https://via.placeholder.com/800x600.png?text=聖地Eアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地E',
            title: '高ボッチ高原',
            animeTitle: 'anime-b',
            description: 'アニメBでリンちゃんが訪れた絶景スポット。夜景も有名。',
            lat: 36.151, lng: 138.036,
            animeTitleDisplay: 'ゆるキャン△'
        }
    ];

    let currentPhotoData = null;
    let isRealImageDisplayedInSingleView = true; // 通常表示で実写が表示されているか
    let isSideBySideActive = false; // 左右比較表示がアクティブか

    // 写真タイルをギャラリーに表示する関数
    function displayPhotos(photosToDisplay) {
        photoGalleryContainer.innerHTML = '';
        photosToDisplay.forEach(photo => {
            const tile = document.createElement('div');
            tile.classList.add('photo-tile');
            tile.dataset.photoId = photo.id;

            const img = document.createElement('img');
            img.src = photo.thumbnailSrc;
            img.alt = photo.title;

            const infoDiv = document.createElement('div');
            infoDiv.classList.add('photo-tile-info');
            infoDiv.innerHTML = `
                <span class="title">${photo.title}</span>
                <span class="anime-title">${photo.animeTitleDisplay}</span>
            `;

            tile.appendChild(img);
            tile.appendChild(infoDiv);
            photoGalleryContainer.appendChild(tile);
            tile.addEventListener('click', () => openModal(photo.id));
        });
    }

    // モーダルを開く関数
    function openModal(photoId) {
        currentPhotoData = dummyPhotos.find(p => p.id === parseInt(photoId));
        if (!currentPhotoData) return;

        // 初期表示は通常(1枚)表示
        isRealImageDisplayedInSingleView = true;
        modalImage.src = currentPhotoData.realSrc;
        sbsAnimeImage.src = currentPhotoData.animeSrc;
        sbsRealImage.src = currentPhotoData.realSrc;

        switchToSingleView(); // 通常表示をアクティブに

        // 詳細情報セット
        photoDescription.textContent = currentPhotoData.description;
        mapPlaceholderModal.innerHTML = `
            ダミー地図 (Leafletなどで描画予定)<br>
            緯度: ${currentPhotoData.lat}, 経度: ${currentPhotoData.lng}
        `;
        const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${currentPhotoData.lat},${currentPhotoData.lng}`;
        streetviewLinkModal.href = streetViewUrl;
        streetviewLinkModal.style.display = 'inline-block';
        streetviewLinkModal.textContent = `ストリートビューで「${currentPhotoData.title}」の場所を見る`;

        modal.style.display = 'block';
    }

    // 通常表示に切り替え
    function switchToSingleView() {
        singleImageView.classList.add('active-view');
        sideBySideView.classList.remove('active-view');
        toggleComparisonButton.textContent = '左右で比較する';
        isSideBySideActive = false;
    }

    // 左右比較表示に切り替え
    function switchToSideBySideView() {
        singleImageView.classList.remove('active-view');
        sideBySideView.classList.add('active-view');
        toggleComparisonButton.textContent = '1枚表示に戻す';
        isSideBySideActive = true;
    }

    // モーダルを閉じる
    modalCloseButton.onclick = () => {
        modal.style.display = 'none';
        currentPhotoData = null;
    }
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
            currentPhotoData = null;
        }
    }

    // 通常表示の画像クリックで実写/アニメシーン切り替え
    modalImage.addEventListener('click', () => {
        if (!currentPhotoData || isSideBySideActive) return; // 比較表示中は無効
        if (isRealImageDisplayedInSingleView) {
            modalImage.src = currentPhotoData.animeSrc;
        } else {
            modalImage.src = currentPhotoData.realSrc;
        }
        isRealImageDisplayedInSingleView = !isRealImageDisplayedInSingleView;
    });

    // 「左右で比較する / 1枚表示に戻す」ボタンの処理
    toggleComparisonButton.addEventListener('click', () => {
        if (!currentPhotoData) return;
        if (isSideBySideActive) {
            switchToSingleView();
        } else {
            switchToSideBySideView();
        }
    });


    // 左ペインのフィルター処理
    filterList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            document.querySelectorAll('#filter-list .filter-item').forEach(item => item.classList.remove('active'));
            event.target.classList.add('active');

            const filterType = event.target.dataset.filter;
            let filteredPhotos;
            if (filterType === 'all') {
                filteredPhotos = dummyPhotos;
            } else {
                filteredPhotos = dummyPhotos.filter(photo => photo.animeTitle === filterType);
            }
            displayPhotos(filteredPhotos);
        }
    });

    // 初期表示 (すべての写真を表示)
    displayPhotos(dummyPhotos);
});
