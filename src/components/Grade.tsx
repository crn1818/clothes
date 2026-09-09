import { useImagem } from './ui';
import { altTextFor } from '../lib/color/palettes';
import type { Post } from '../lib/types';

function ItemGrade({ post, onAbrir }: { post: Post; onAbrir: () => void }) {
  const url = useImagem(post, 'thumb');

  return (
    <button className="grade-item" onClick={onAbrir}>
      {url ? (
        <img src={url} alt={altTextFor(post.cores, post.caption)} loading="eager" />
      ) : (
        <div className="foto-esqueleto" style={{ height: '100%', aspectRatio: 'auto' }} />
      )}

      {post.pins.length > 0 && <span className="grade-marca">{post.pins.length}</span>}

      <span className="grade-paleta" aria-hidden="true">
        {post.cores.map((c, i) => (
          <i key={`${c.hex}-${i}`} style={{ flexGrow: c.share, background: c.hex }} />
        ))}
      </span>
    </button>
  );
}

/** Grade de miniaturas com a paleta de cada look na base. */
export function Grade({
  posts,
  onAbrir,
}: {
  posts: Post[];
  onAbrir: (post: Post) => void;
}) {
  return (
    <div className="grade">
      {posts.map((p) => (
        <ItemGrade key={p.id} post={p} onAbrir={() => onAbrir(p)} />
      ))}
    </div>
  );
}
